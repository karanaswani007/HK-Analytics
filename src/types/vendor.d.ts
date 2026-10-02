declare module "papaparse" {
  const Papa: {
    parse: <T = unknown>(
      input: string,
      config?: {
        skipEmptyLines?: boolean | "greedy";
        comments?: boolean;
        header?: boolean;
      },
    ) => {
      data: T[];
      errors: { message: string; row?: number }[];
      meta: { fields?: string[]; delimiter: string };
    };
  };
  export default Papa;
}
