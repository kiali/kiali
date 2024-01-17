import axios, { AxiosResponse, AxiosError } from 'axios';

export interface KialiError {
  detail: string;
  error: string;
}

export type ApiResponse<T> = Partial<AxiosResponse<T>> & {
  data: T;
};

export type ApiError = AxiosError<KialiError>;

export const isApiError = axios.isAxiosError;
