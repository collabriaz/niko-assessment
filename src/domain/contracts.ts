export const clientActionRequired = (status: string) =>
  status === "issued" ? "Review and accept or request changes" : null;
