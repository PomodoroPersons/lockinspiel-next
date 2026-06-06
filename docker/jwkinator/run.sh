if [ ! -e "/etc/config/kratos-keys/jwks.priv.json" ]; then
  step crypto jwk create /etc/config/kratos-keys/es256.pub.jwk.json /etc/config/kratos-keys/es256.jwk.json --no-password --insecure -f
  step crypto jwk keyset add /etc/config/kratos-keys/jwks.priv.json < /etc/config/kratos-keys/es256.jwk.json
  step crypto jwk keyset add /etc/config/kratos-keys/.well-known/jwks.json < /etc/config/kratos-keys/es256.pub.jwk.json
fi
