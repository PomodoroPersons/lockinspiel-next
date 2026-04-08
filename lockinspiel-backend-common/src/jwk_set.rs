use std::{net::ToSocketAddrs, sync::Arc};

use arc_swap::ArcSwap;
use jsonwebtoken::{DecodingKey, Validation, jwk::JwkSet};
use reqwest::Url;
use serde::de::DeserializeOwned;
use tokio::sync::OnceCell;

use crate::{
    auth::ErrorKind,
    error::{Error, WithReason},
};

pub struct JwkSetManager {
    jwk_set: ArcSwap<OnceCell<JwkSet>>,
    auth_url: Url,
}

impl JwkSetManager {
    pub fn new(auth_url: &str) -> Result<Self, Error<ErrorKind>> {
        Ok(Self {
            jwk_set: ArcSwap::from_pointee(OnceCell::new()),
            auth_url: Url::parse(auth_url)
                .map_err(|_| ErrorKind::UrlParseError)
                .with_reason("Failed to parse auth URL")?,
        })
    }

    async fn find_impl(&self, kid: &str) -> Result<DecodingKey, Error<ErrorKind>> {
        let jwk_set = self.jwk_set.load();

        let jwks = jwk_set.get_or_try_init(|| self.get_new_jwks()).await?;

        if let Some(jwk) = jwks.find(kid) {
            return Ok(
                DecodingKey::from_jwk(jwk).with_reason("Failed to convert JWK to decoding key")?
            );
        }

        return Err(ErrorKind::KIDError).no_additional_reason();
    }

    pub async fn find(&self, kid: &str) -> Result<DecodingKey, Error<ErrorKind>> {
        match self.find_impl(kid).await {
            Ok(jwk) => Ok(jwk),
            Err(Error {
                source: ErrorKind::KIDError,
                ..
            }) => {
                self.jwk_set.store(Arc::new(OnceCell::new()));
                self.find_impl(kid).await
            }
            Err(e) => Err(e),
        }
    }

    pub async fn decode<C: DeserializeOwned>(
        &self,
        token: impl AsRef<[u8]>,
        validation: &Validation,
    ) -> Result<C, Error<ErrorKind>> {
        let token = token.as_ref();

        let header =
            jsonwebtoken::decode_header(token).with_reason("Failed to decode JWT header")?;

        let decoding_key = self
            .find(
                &header
                    .kid
                    .ok_or(ErrorKind::KIDError)
                    .with_reason("There's no kid on this JWT")?,
            )
            .await?;

        let token: C = jsonwebtoken::decode(token, &decoding_key, validation)
            .with_reason("Failed to decode JWT")?
            .claims;

        Ok(token)
    }

    async fn get_new_jwks(&self) -> Result<JwkSet, Error<ErrorKind>> {
        let jwks_url = self
            .auth_url
            .join(".well-known/jwks.json")
            .map_err(|_| ErrorKind::UrlParseError)
            .with_reason("Failed to parse composed JWKS URL")?;

        let auth_service_host = jwks_url
            .host_str()
            .ok_or(ErrorKind::UrlParseError)
            .with_reason("No hostname was found in the auth_service URL")?;

        Ok(JwkSet {
            keys: futures_util::future::try_join_all(
                (auth_service_host, jwks_url.port().unwrap_or_default())
                    .to_socket_addrs()
                    .with_reason("Failed to resolve address for auth service")?
                    .map(|addr| {
                        let jwks_url = jwks_url.clone();
                        async move {
                            let mut jwks: JwkSet = reqwest::ClientBuilder::new()
                                .resolve(auth_service_host, addr)
                                .build()
                                .with_reason("Failed to build reqwest client for JWKs requst")?
                                .get(jwks_url)
                                .send()
                                .await
                                .with_reason("Failed to send request for JWKS")?
                                .error_for_status()
                                .with_reason("Server JWKS endpoint returned an error")?
                                .json()
                                .await
                                .with_reason("Failed to decode JWKS")?;

                            Ok::<_, Error<ErrorKind>>(jwks.keys.swap_remove(0))
                        }
                    }),
            )
            .await?,
        })
    }
}
