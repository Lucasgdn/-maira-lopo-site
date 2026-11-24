export async function disconnectWhatsApp(client) {
  try {
    if (!(await client.logout())) {
      throw new Error("O WhatsApp nao confirmou a desconexao.");
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Execution context was destroyed")) {
      throw error;
    }

    try {
      await client.waPage.waitForFunction(
        () => Boolean(document.querySelector("body > div > div > .landing-wrapper") &&
          document.querySelector("canvas")),
        { timeout: 90000 },
      );
    } catch (reason) {
      throw new Error(
        "O WhatsApp nao confirmou a desconexao. Confira Dispositivos conectados no celular.",
        { cause: reason },
      );
    }
  }
}
