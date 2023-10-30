export const ENDPOINT_MAPPING = {
  sandbox: "https://api.stackadapt.dev/public/graphql",
  production: "https://api.stackadapt.com/public/graphql"
}

export const mapEndpoint = (endpoint: keyof typeof ENDPOINT_MAPPING) => {
  return ENDPOINT_MAPPING[endpoint];
} 