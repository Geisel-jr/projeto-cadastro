#!/bin/sh
# Restaura um backup do CadastroHub (banco + arquivos).
#
#   restaurar.sh                    lista os backups disponíveis
#   restaurar.sh <arquivo.dump>     restaura (pede CONFIRMAR=sim)
#   restaurar.sh ultimo             restaura o mais recente (pede CONFIRMAR=sim)
#
# ATENÇÃO: substitui TODOS os dados atuais do banco pelos do backup, inclusive a
# auditoria feita depois dele.
set -eu

PASTA=/backups/banco

if [ $# -eq 0 ]; then
  echo "Backups disponíveis (mais recente por último):"
  ls -1 "$PASTA"/*.dump 2> /dev/null | xargs -r -n1 basename || true
  echo
  echo "Para restaurar: CONFIRMAR=sim restaurar.sh <arquivo.dump>   (ou: ultimo)"
  exit 0
fi

if [ "$1" = "ultimo" ]; then
  arquivo=$(ls -1 "$PASTA"/*.dump 2> /dev/null | sort | tail -n 1)
else
  arquivo="$PASTA/$(basename "$1")"
fi

if [ -z "${arquivo:-}" ] || [ ! -f "$arquivo" ]; then
  echo "Backup não encontrado: ${1}"
  exit 1
fi

if [ "${CONFIRMAR:-}" != "sim" ]; then
  echo "Isto vai SUBSTITUIR todos os dados atuais pelos do backup $(basename "$arquivo")."
  echo "Para confirmar, rode de novo com CONFIRMAR=sim"
  exit 1
fi

echo "Restaurando o banco a partir de $(basename "$arquivo")..."
pg_restore --clean --if-exists --no-owner --single-transaction --dbname="$PGDATABASE" "$arquivo"

echo "Restaurando os arquivos dos documentos..."
mc alias set origem "http://$MINIO_HOST:9000" "$MINIO_USER" "$MINIO_PASSWORD" > /dev/null
mc mirror --overwrite --quiet /backups/arquivos "origem/$MINIO_BUCKET" > /dev/null

echo "Restauração concluída. Reinicie a API: docker compose restart api"
