use std::borrow::Cow;

use logos::{Logos, Skip};

pub struct UrlConfig {
    pub user_service: String,
    pub s3_service: String,
}

#[derive(Logos, Debug, PartialEq)]
enum Token<'a> {
    #[token("user_service")]
    UserService,

    #[token("s3_service")]
    S3Service,

    #[regex(r"[^{]+")]
    Text(&'a str),

    #[regex(r"\{[ \t\r\n\f]+", |_| Skip)]
    OpeningWhitespace,

    #[regex(r"[ \t\r\n\f]+\}", |_| Skip)]
    ClosingWhitespace,
}

impl UrlConfig {
    pub fn template_url<'a>(&self, input: &'a str) -> Result<Cow<'a, str>, ()> {
        let mut result = Cow::Borrowed("");
        let lexer = Token::lexer(input);

        macro_rules! push {
            ($string:expr) => {
                if result.is_empty() {
                    result = Cow::Borrowed($string);
                } else {
                    result.to_mut().push_str($string);
                }
            };
        }

        for token in lexer {
            match token? {
                Token::UserService => result.to_mut().push_str(&self.user_service),
                Token::S3Service => result.to_mut().push_str(&self.s3_service),
                Token::Text(t) => push!(t),
                Token::OpeningWhitespace | Token::ClosingWhitespace => {}
            }
        }

        Ok(result)
    }
}
