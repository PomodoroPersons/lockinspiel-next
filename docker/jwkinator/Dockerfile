FROM smallstep/step-cli

USER root

ARG STEPUID=1000
ARG STEPGID=1000

RUN install -o ${STEPUID} -g ${STEPGID} -d /etc/config/kratos-keys && \
    install -o ${STEPUID} -g ${STEPGID} -d /etc/config/kratos-keys/.well-known
VOLUME /etc/config/kratos-keys

USER ${STEPUID}:${STEPGID}

CMD ["/bin/sh", "-c", "step crypto jwk create /etc/config/kratos-keys/es256.pub.jwk.json /etc/config/kratos-keys/es256.jwk.json --no-password --insecure -f && rm -f /etc/config/kratos-keys/jwks.priv.json && rm -f /etc/config/kratos-keys/.well-known/jwks.json && step crypto jwk keyset add /etc/config/kratos-keys/jwks.priv.json < /etc/config/kratos-keys/es256.jwk.json && step crypto jwk keyset add /etc/config/kratos-keys/.well-known/jwks.json < /etc/config/kratos-keys/es256.pub.jwk.json"]
