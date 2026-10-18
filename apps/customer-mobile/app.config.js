function withApiUrl({ config }) {
  return {
    ...config,
    extra: {
      ...config.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl || "http://localhost:8080",
    },
  };
}

export default withApiUrl;