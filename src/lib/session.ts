export const getToken = (): string =>
  typeof window !== 'undefined' ? sessionStorage.getItem('rf_token') ?? '' : '';
