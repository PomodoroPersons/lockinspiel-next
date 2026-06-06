local claims = std.extVar('claims');
local session = std.extVar('session');

{
  claims: {
    identity: {
      [session.identity.schema_id]: session.identity.traits
    }
  }
}
