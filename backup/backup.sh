#!/bin/sh
# Backup do CadastroHub: banco (pg_dump) e arquivos dos documentos (MinIO).
#
#   backup.sh            roda agora e depois a cada BACKUP_INTERVALO_HORAS (padrão 24)
#   backup.sh agora      roda uma vez e sai
#
# Banco:    /backups/banco/AAAA-MM-DD_HH-MM-SS.dump, guardados por BACKUP_RETENCAO_DIAS (padrão 7)
# Arquivos: /backups/arquivos, espelho do bucket. Como os documentos nunca são apagados
#           de verdade no MinIO (soft delete), o espelho só cresce e não é duplicado.
set -u

INTERVALO_HORAS="${BACKUP_INTERVALO_HORAS:-24}"
RETENCAO_DIAS="${BACKUP_RETENCAO_DIAS:-7}"
DESTINO=/backups

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

fazer_backup() {
  momento=$(date '+%Y-%m-%d_%H-%M-%S')
  mkdir -p "$DESTINO/banco" "$DESTINO/arquivos"
  log "Iniciando backup $momento"

  # Grava num arquivo temporário e só renomeia quando termina: nunca fica um .dump pela metade
  if ! pg_dump --format=custom --file="$DESTINO/banco/$momento.dump.parcial"; then
    rm -f "$DESTINO/banco/$momento.dump.parcial"
    log "ERRO: falha ao copiar o banco"
    return 1
  fi
  mv "$DESTINO/banco/$momento.dump.parcial" "$DESTINO/banco/$momento.dump"
  log "Banco copiado: $(du -h "$DESTINO/banco/$momento.dump" | cut -f1)"

  if ! mc alias set origem "http://$MINIO_HOST:9000" "$MINIO_USER" "$MINIO_PASSWORD" > /dev/null \
     || ! mc mirror --overwrite --quiet "origem/$MINIO_BUCKET" "$DESTINO/arquivos" > /dev/null; then
    log "ERRO: falha ao copiar os arquivos do MinIO"
    return 1
  fi
  log "Arquivos espelhados: $(find "$DESTINO/arquivos" -type f | wc -l) arquivo(s)"

  # Cópias do banco mais antigas que a retenção são apagadas de verdade: o backup mais
  # recente já contém tudo (inclusive a auditoria), então elas não têm o que ser consultado
  find "$DESTINO/banco" -name '*.dump' -mtime +"$RETENCAO_DIAS" -print -delete | while read -r antigo; do
    log "Removido backup antigo: $(basename "$antigo")"
  done
  log "Backup concluído"
}

case "${1:-agendado}" in
  agora)
    fazer_backup
    ;;
  agendado)
    log "Backup automático a cada ${INTERVALO_HORAS}h, guardando ${RETENCAO_DIAS} dia(s) de cópias do banco"
    while true; do
      fazer_backup || log "O próximo backup será tentado no horário agendado"
      sleep $((INTERVALO_HORAS * 3600))
    done
    ;;
  *)
    echo "Uso: backup.sh [agora]"
    exit 1
    ;;
esac
