# Imagem do backup: Postgres 16 (pg_dump/pg_restore da mesma versão do banco)
# + cliente do MinIO (mc), copiado da imagem do próprio MinIO usada no projeto.
FROM pgsty/minio:RELEASE.2026-08-04T00-00-00Z AS minio

FROM postgres:16-alpine
COPY --from=minio /usr/bin/mc /usr/local/bin/mc
COPY backup.sh restaurar.sh /usr/local/bin/
# Remove quebras de linha do Windows (CRLF), caso o repositório tenha sido baixado no Windows
RUN sed -i 's/\r$//' /usr/local/bin/backup.sh /usr/local/bin/restaurar.sh \
 && chmod +x /usr/local/bin/backup.sh /usr/local/bin/restaurar.sh

VOLUME /backups
ENTRYPOINT ["backup.sh"]
