FROM smallstep/step-cli

USER root

ARG STEPUID=1000
ARG STEPGID=1000

RUN install -o ${STEPUID} -g ${STEPGID} -d /etc/config/kratos-keys && \
    install -o ${STEPUID} -g ${STEPGID} -d /etc/config/kratos-keys/.well-known
VOLUME /etc/config/kratos-keys

USER ${STEPUID}:${STEPGID}

COPY --chown=${STEPUID}:${STEPGID} private.pem /etc/config/private.pem
COPY run.sh run.sh

CMD ["/bin/sh", "run.sh"]
