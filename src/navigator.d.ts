interface Navigator {
  userAgentData?: {
    readonly brands: { brand: string; version: string }[];
    readonly mobile: boolean;
    readonly platform: string;
  };
}
