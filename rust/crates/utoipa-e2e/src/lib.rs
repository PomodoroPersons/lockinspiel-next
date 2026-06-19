use proc_macro2::{TokenStream, TokenTree};
use quote::{ToTokens, format_ident, quote};
use syn::{
    Field, Fields, GenericParam, Ident, ItemFn, ItemStruct, Lifetime, LifetimeParam, Meta, Token,
    Type, parse::Parse, punctuated::Punctuated, spanned::Spanned,
};

#[derive(Debug)]
struct ConfigItem(TokenStream);

impl Parse for ConfigItem {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let mut result = TokenStream::new();

        result.extend(std::iter::from_fn(|| {
            if input.peek(Token![,]) {
                return None;
            }

            input.parse::<TokenTree>().ok()
        }));

        Ok(Self(result))
    }
}

impl ToTokens for ConfigItem {
    fn to_tokens(&self, tokens: &mut TokenStream) {
        self.0.to_tokens(tokens);
    }

    fn to_token_stream(&self) -> TokenStream {
        self.0.to_token_stream()
    }

    fn into_token_stream(self) -> TokenStream
    where
        Self: Sized,
    {
        self.0
    }
}

#[derive(Debug)]
struct SecurityRequirement {
    name: TokenTree,
    scopes: Punctuated<TokenTree, Token![,]>,
}

impl Parse for SecurityRequirement {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let name: TokenTree = input.parse()?;
        let _: Token![=] = input.parse()?;
        let content;
        syn::bracketed!(content in input);

        Ok(Self {
            name,
            scopes: content.parse_terminated(TokenTree::parse, Token![,])?,
        })
    }
}

#[derive(Debug)]
struct SecurityRequirements(Punctuated<SecurityRequirement, Token![,]>);

impl Parse for SecurityRequirements {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let content;
        syn::parenthesized!(content in input);

        Ok(Self(
            content.parse_terminated(SecurityRequirement::parse, Token![,])?,
        ))
    }
}

#[derive(Debug)]
enum Configs {
    HttpMethod(String),
    ParameterIn(Ident),
    Path(ConfigItem),
    Tag(ConfigItem),
    Summary(ConfigItem),
    Description(ConfigItem),
    Responses(Type),
    Security(Punctuated<SecurityRequirements, Token![,]>),
    ContentType(ConfigItem),
    None,
}

impl Parse for Configs {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        let ident: syn::Ident = input.parse()?;
        let ident_string = ident.to_string();

        match ident_string.as_str() {
            "get" | "post" | "put" | "delete" | "options" | "head" | "patch" | "trace" => {
                Ok(Self::HttpMethod(ident_string))
            }
            "path" => {
                let _eq: Token![=] = input.parse()?;
                Ok(Self::Path(input.parse()?))
            }
            "tag" => {
                let _eq: Token![=] = input.parse()?;
                Ok(Self::Tag(input.parse()?))
            }
            "summary" => {
                let _eq: Token![=] = input.parse()?;
                Ok(Self::Summary(input.parse()?))
            }
            "description" => {
                let _eq: Token![=] = input.parse()?;
                Ok(Self::Description(input.parse()?))
            }
            "content_type" => {
                let _eq: Token![=] = input.parse()?;
                Ok(Self::ContentType(input.parse()?))
            }
            "responses" => {
                let responses;
                syn::parenthesized!(responses in input);
                Ok(Self::Responses(responses.parse()?))
            }
            "security" => {
                let content;
                syn::parenthesized!(content in input);
                Ok(Self::Security(content.parse_terminated(
                    SecurityRequirements::parse,
                    Token![,],
                )?))
            }
            "Query" | "Path" | "Header" | "Cookie" => Ok(Self::ParameterIn(ident)),
            // kw => Err(syn::Error::new(
            //     ident.span(),
            //     format_args!("Unexpected keyword `{}`", kw),
            // )),
            _ => {
                let _: ConfigItem = input.parse()?;
                Ok(Self::None)
            }
        }
    }
}

#[derive(Default)]
struct CommaDelimetedConfigs(Punctuated<Configs, Token![,]>);

impl Parse for CommaDelimetedConfigs {
    fn parse(input: syn::parse::ParseStream) -> syn::Result<Self> {
        Ok(Self(input.parse_terminated(Configs::parse, Token![,])?))
    }
}

#[proc_macro_derive(IntoPath, attributes(api_path, body, param))]
pub fn derive_into_path(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let ast = syn::parse_macro_input!(input as ItemStruct);
    let ItemStruct {
        attrs,
        ident,
        generics,
        fields,
        ..
    } = &ast;

    let Fields::Named(named_fields) = fields else {
        return syn::Error::new(
            fields.span(),
            "This macro only operates on structs with named fields",
        )
        .into_compile_error()
        .into();
    };

    let configs = match attrs
        .first()
        .map(|a| a.parse_args::<CommaDelimetedConfigs>())
    {
        Some(Ok(configs)) => configs,
        Some(Err(e)) => return e.into_compile_error().into(),
        None => CommaDelimetedConfigs::default(),
    };

    let mut path: Option<TokenStream> = None;
    let mut summary: Option<TokenStream> = None;
    let mut description: Option<TokenStream> = None;
    let mut responses: Option<TokenStream> = None;
    let mut request_body: Option<TokenStream> = None;
    let mut response_body_schema: Option<TokenStream> = None;
    let mut parameters: Vec<TokenStream> = Vec::new();
    let mut securities: Vec<TokenStream> = Vec::new();
    let mut http_methods: Vec<TokenStream> = Vec::new();
    let mut tags: Vec<&ConfigItem> = Vec::new();
    let mut schemas: Vec<&Type> = Vec::new();

    for field in named_fields.named.iter() {
        let Field {
            attrs, ident, ty, ..
        } = &field;

        for attr in attrs {
            if attr.meta.path().is_ident("body") {
                let mut description: Option<TokenStream> = None;
                let mut content_type = quote! { "application/json" };

                if matches!(attr.meta, Meta::List(_)) {
                    match attr.parse_args::<CommaDelimetedConfigs>() {
                        Ok(configs) => {
                            for config in configs.0.into_iter() {
                                match config {
                                    Configs::Description(d) => {
                                        description = Some(quote! { .description(Some(#d)) })
                                    }
                                    Configs::ContentType(c) => content_type = quote! { #c },
                                    _ => {}
                                }
                            }
                        }
                        Err(e) => return e.into_compile_error().into(),
                    }
                }

                request_body = Some(quote! {
                    .request_body(Some(
                        utoipa::openapi::request_body::RequestBodyBuilder::new()
                            #description
                            .content(
                                #content_type,
                                utoipa::openapi::content::ContentBuilder::new()
                                    .schema(Some(
                                        utoipa::openapi::schema::RefBuilder::new()
                                            .ref_location_from_schema_name(
                                                <#ty as utoipa::ToSchema>::name()
                                            )
                                    ))
                                    .build()
                            )
                            .required(Some(utoipa::openapi::Required::True))
                            .build()
                    ))
                });

                schemas.push(ty);
            } else if attr.meta.path().is_ident("param") {
                let mut description: Option<TokenStream> = None;
                let mut parameter_in: Option<TokenStream> = None;

                if matches!(attr.meta, Meta::List(_)) {
                    match attr.parse_args::<CommaDelimetedConfigs>() {
                        Ok(configs) => {
                            for config in configs.0.into_iter() {
                                match config {
                                    Configs::Description(d) => {
                                        description = Some(quote! { .description(Some(#d)) })
                                    }
                                    Configs::ParameterIn(p) => {
                                        parameter_in = Some(
                                            quote! { .parameter_in(utoipa::openapi::path::ParameterIn::#p) },
                                        );
                                    }
                                    _ => {}
                                }
                            }
                        }
                        Err(e) => return e.into_compile_error().into(),
                    }
                }

                parameters.push(quote! {
                    .parameter(
                        utoipa::openapi::path::ParameterBuilder::new()
                            #description
                            #parameter_in
                            .name(stringify!(#ident))
                            .schema(Some(
                                <#ty as utoipa::PartialSchema>::schema()
                            ))
                            .build()
                    )
                });
            }
        }
    }

    for config in configs.0.iter() {
        match config {
            Configs::HttpMethod(method) => match method.as_str() {
                "get" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Get }),
                "post" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Post }),
                "put" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Put }),
                "delete" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Delete }),
                "options" => {
                    http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Options })
                }
                "head" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Head }),
                "patch" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Patch }),
                "trace" => http_methods.push(quote! { utoipa::openapi::path::HttpMethod::Trace }),
                _ => panic!(),
            },
            Configs::Path(p) => path = Some(p.0.clone()),
            Configs::Tag(t) => {
                tags.push(t);
            }
            Configs::Summary(s) => summary = Some(quote! { .summary(Some(#s)) }),
            Configs::Description(d) => description = Some(quote! { .description(Some(#d)) }),
            Configs::Responses(r) => {
                responses = Some(
                    quote! { .responses(utoipa::openapi::ResponsesBuilder::new().responses_from_into_responses::<#r>().build()) },
                );
                response_body_schema = Some(quote! {
                   <#r as utoipa::ToSchema>::schemas(schemas);

                });
            }
            Configs::Security(s) => {
                for security_requirement in s.iter() {
                    let mut requirement_tokens = quote! {
                        utoipa::openapi::SecurityRequirement::default()
                    };
                    for SecurityRequirement { name, scopes } in security_requirement.0.iter() {
                        requirement_tokens.extend(quote! {
                            .add::<_, _, &str>(#name, [#scopes])
                        });
                    }
                    securities.push(requirement_tokens);
                }
            }
            _ => {}
        }
    }

    // 2. Generate output using quote!
    let mut expanded = quote! {};

    let mut tags_generics = generics.clone();
    let tag_lt = Lifetime::new("'t", proc_macro2::Span::call_site());
    let tag_ltp = LifetimeParam::new(tag_lt.clone());
    let tag_param = GenericParam::from(tag_ltp);
    tags_generics.params.push(tag_param);

    let (tag_generics, _, _) = tags_generics.split_for_impl();

    let (impl_generics, ty_generics, where_clause) = generics.split_for_impl();

    #[cfg(feature = "utoipa")]
    expanded.extend(quote! {
        impl #tag_generics utoipa::__dev::Tags<#tag_lt> for #ident #ty_generics #where_clause {
            fn tags() -> Vec<&'t str> {
                [#(#tags),*].into()
            }
        }

        impl #impl_generics utoipa::Path for #ident #ty_generics #where_clause {
            fn methods() -> Vec<utoipa::openapi::path::HttpMethod> {
                [#(#http_methods),*].into()
            }

            fn path() -> String {
                String::from(#path)
            }

            fn operation() -> utoipa::openapi::path::Operation {
                utoipa::openapi::path::OperationBuilder::new()
                    #summary
                    #description
                    #request_body
                    #(#parameters)*
                    #responses
                    .securities(Some([#(#securities),*]))
                    .build()
            }
        }

        impl #impl_generics utoipa::__dev::SchemaReferences for #ident #ty_generics #where_clause {
            fn schemas(
                schemas: &mut Vec<
                    (String, utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>),
                >,
            ) {
                #(
                    schemas
                        .push((
                            String::from(
                                <#schemas as utoipa::ToSchema>::name(),
                            ),
                            <#schemas as utoipa::PartialSchema>::schema(),
                        ));
                    <#schemas as utoipa::ToSchema>::schemas(schemas);
                )*

                #response_body_schema
            }
        }
    });

    // 3. Return output
    expanded.into()
}

// #[proc_macro_derive(IntoResponseFixinator, attributes(to_schema))]
// pub fn derive_into_response_fixinator(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
//     let ast = syn::parse_macro_input!(input as DeriveInput);
//     let DeriveInput {
//         attrs,
//         vis,
//         ident,
//         generics,
//         data,
//     } = &ast;

//     let mut schemas: Vec<TokenStream> = Vec::new();

//     // 2. Generate output using quote!
//     let expanded = quote! {
//         impl utoipa::__dev::SchemaReferences for #ident #generics {
//             fn schemas(
//                 schemas: &mut Vec<
//                     (String, utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>),
//                 >,
//             ) {
//                 #(
//                     schemas
//                         .push((
//                             String::from(
//                                 <#schemas as utoipa::ToSchema>::name(),
//                             ),
//                             <#schemas as utoipa::PartialSchema>::schema(),
//                         ));
//                     <#schemas as utoipa::ToSchema>::schemas(schemas);
//                 )*
//             }
//         }
//     };

//     // 3. Return output
//     expanded.into()
// }

#[cfg(feature = "utoipa")]
#[proc_macro_attribute]
pub fn implementor_of(
    attr: proc_macro::TokenStream,
    item: proc_macro::TokenStream,
) -> proc_macro::TokenStream {
    let attr = syn::parse_macro_input!(attr as TokenTree);
    let item = syn::parse_macro_input!(item as ItemFn);

    let ident = &item.sig.ident;

    let phantom_struct_ident = format_ident!("__path_{}", ident);

    let expanded = quote! {
        #[derive(Clone)]
        #[allow(non_camel_case_types)]
        #[doc(hidden)]
        pub struct #phantom_struct_ident;

        impl<'t> utoipa::__dev::Tags<'t> for #phantom_struct_ident {
            fn tags() -> Vec<&'t str> {
                <#attr as utoipa::__dev::Tags>::tags()
            }
        }

        impl utoipa::Path for #phantom_struct_ident {
            fn path() -> String {
                <#attr as utoipa::Path>::path()
            }

            fn methods() -> Vec<utoipa::openapi::path::HttpMethod> {
                <#attr as utoipa::Path>::methods()
            }

            fn operation() -> utoipa::openapi::path::Operation {
                let mut op = <#attr as utoipa::Path>::operation();
                op.operation_id = Some(stringify!(#ident).to_owned());
                op
            }
        }

        impl utoipa::__dev::SchemaReferences for #phantom_struct_ident {
            fn schemas(
                schemas: &mut Vec<
                    (String, utoipa::openapi::RefOr<utoipa::openapi::schema::Schema>),
                >,
            ) {
                <#attr as utoipa::__dev::SchemaReferences>::schemas(schemas)
            }
        }

        #item
    };

    expanded.into()
}
