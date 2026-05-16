use std::{borrow::Cow, ops::Deref, time::Duration};

use aws_sdk_s3::presigning::PresigningConfig;
use serde::{Deserialize, Serialize};

pub struct UrlResolver {
    bucket_name: String,
    s3_client: aws_sdk_s3::Client,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UrlOrigin {
    S3,
    UserService,
}

#[derive(Deserialize, Serialize)]
pub struct UrlLocation<'a> {
    pub location: UrlOrigin,
    pub path: Cow<'a, str>,
}

impl UrlResolver {
    pub fn new(bucket_name: String, s3_client: aws_sdk_s3::Client) -> Self {
        Self {
            bucket_name,
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

    pub async fn resolve_put_url(&self, location: UrlLocation<'_>) -> String {
        match location.location {
            UrlOrigin::UserService => format!("/user/{}", location.path),
            UrlOrigin::S3 => self
                .s3_client
                .put_object()
                .bucket(self.bucket_name.deref().to_owned())
                .key(location.path.trim_start_matches('/'))
                .presigned(PresigningConfig::expires_in(Duration::from_secs(600)).unwrap())
                .await
                .unwrap()
                .uri()
                .to_owned(),
        }
    }
}
