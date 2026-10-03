/** A valid upload whose content cannot be converted without user action. */
export class UnsupportedConversionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedConversionInputError";
  }
}

/** Conversion cannot run because its required server runtime is unavailable. */
export class ConversionRuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionRuntimeUnavailableError";
  }
}
