import { iosVersion } from "./safari";

export const rewriteError = (error: DOMException | null): Error => {
  if (error == null) {
    return new Error("Unknown IndexedDB error");
  }

  if (iosVersion.get() >= 12.2 && iosVersion.get() < 13) {
    const IOS_ERROR =
      "An internal error was encountered in the Indexed Database server";

    if (error.message.indexOf(IOS_ERROR) >= 0) {
      // https://bugs.webkit.org/show_bug.cgi?id=197050
      return new Error(
        `IndexedDB has thrown '${IOS_ERROR}'. This is likely ` +
          `due to an unavoidable bug in iOS. See https://stackoverflow.com/q/56496296/110915 ` +
          `for details and a potential workaround.`,
      );
    }
  }

  return error;
};
