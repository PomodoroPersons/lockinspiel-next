pub mod tag;
pub mod time_split;
pub mod timer;

macro_rules! conditional_query {
    ($condition:expr, $var_name:ident, $true:expr, $false:expr, $then:expr) => {
        if $condition {
            let $var_name = $true;
            $then
        } else {
            let $var_name = $false;
            $then
        }
    };
    (let Some($some_name:ident) = $input:expr, $var_name:ident, $true:expr, $false:expr, $then:expr) => {
        if let Some($some_name) = $input {
            let $var_name = $true;
            $then
        } else {
            let $var_name = $false;
            $then
        }
    };
}

pub(crate) use conditional_query;
