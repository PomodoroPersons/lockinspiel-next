use std::{borrow::Cow, fmt::Debug, ops::Deref, time::Duration};

use aws_sdk_s3::{
    error::SdkError, operation::delete_object::DeleteObjectError, presigning::PresigningConfig,
};
use axum::http::StatusCode;
use lockinspiel_backend_common::{
    Placeholder,
    error::{AsStatusCode, Error, WithReason},
};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::ToSchema;

#[derive(Error, Debug)]
pub enum UrlResolutionError {
    #[error("Failed to delete object in S3")]
    S3DeleteError(#[from] SdkError<DeleteObjectError>),
    #[error("Deleting from user service asset directory is unimplemented")]
    DeletingFromUserService,
}

impl AsStatusCode for UrlResolutionError {
    fn status_code(&self) -> axum::http::StatusCode {
        match self {
            Self::S3DeleteError(error) => error
                .raw_response()
                .map_or(StatusCode::INTERNAL_SERVER_ERROR, |r| {
                    StatusCode::from_u16(r.status().as_u16()).unwrap()
                }),
            Self::DeletingFromUserService => StatusCode::BAD_REQUEST,
        }
    }
}

pub struct UrlResolver {
    bucket_name: String,
    internal_s3_endpoint: Option<String>,
    s3_client: aws_sdk_s3::Client,
}

impl Debug for UrlResolver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("UrlResolver")
            .field("bucket_name", &self.bucket_name)
            .finish_non_exhaustive()
    }
}

#[derive(Deserialize, Serialize, ToSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum UrlOrigin {
    S3,
    UserService,
}

#[derive(Deserialize, Serialize, ToSchema, Debug)]
pub struct UrlLocation<'a> {
    pub location: UrlOrigin,
    pub path: Cow<'a, str>,
}

impl<'a> Placeholder for UrlLocation<'a> {
    fn placeholder() -> Self {
        Self {
            location: UrlOrigin::S3,
            path: Cow::Borrowed("avatar/johndoe.png"),
        }
    }
}

impl UrlResolver {
    pub fn new(
        bucket_name: String,
        internal_s3_endpoint: Option<String>,
        s3_client: aws_sdk_s3::Client,
    ) -> Self {
        Self {
            bucket_name,
            internal_s3_endpoint,
            s3_client,
        }
    }

    pub async fn resolve_get_url(&self, location: UrlLocation<'_>) -> String {
        match location.location {
            UrlOrigin::UserService => format!("/user/{}", location.path),
            UrlOrigin::S3 => self
                .s3_client
                .get_object()
                .bucket(self.bucket_name.deref().to_owned())
                .key(location.path.trim_start_matches('/'))
                .presigned(PresigningConfig::expires_in(Duration::from_secs(600)).unwrap())
                .await
                .unwrap()
                .uri()
                .to_owned(),
        }
    }

    pub async fn resolve_put_url(&self, location: UrlLocation<'_>, content_type: String) -> String {
        match location.location {
            UrlOrigin::UserService => format!("/user/{}", location.path),
            UrlOrigin::S3 => self
                .s3_client
                .put_object()
                .bucket(self.bucket_name.deref().to_owned())
                .key(location.path.trim_start_matches('/'))
                .content_type(content_type)
                .presigned(PresigningConfig::expires_in(Duration::from_secs(600)).unwrap())
                .await
                .unwrap()
                .uri()
                .to_owned(),
        }
    }

    pub async fn delete_url(
        &self,
        location: UrlLocation<'_>,
    ) -> Result<(), Error<UrlResolutionError>> {
        match location.location {
            UrlOrigin::UserService => {
                return Err(UrlResolutionError::DeletingFromUserService).no_additional_reason();
            }
            UrlOrigin::S3 => {
                let mut request = self
                    .s3_client
                    .delete_object()
                    .bucket(self.bucket_name.deref().to_owned())
                    .key(location.path.trim_start_matches('/'))
                    .customize();

                if let Some(endpoint) = self.internal_s3_endpoint.clone() {
                    request = request.mutate_request(move |r| {
                        r.uri_mut().set_endpoint(&endpoint).unwrap();
                    });
                }

                request.send().await.no_additional_reason()?;
            }
        }

        Ok(())
    }
}
