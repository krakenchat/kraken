import { useQuery } from "@tanstack/react-query";
import { userControllerGetProfileOptions } from "../api-client/@tanstack/react-query.gen";

export const useCurrentUser = () => {
  const { data: user, isLoading, isError, error } = useQuery(userControllerGetProfileOptions());

  return { user, isLoading, isError, error };
};
