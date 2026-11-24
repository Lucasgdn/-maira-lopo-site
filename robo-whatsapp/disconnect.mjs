export async function disconnectWhatsApp(client, pairingScreen) {
  try {
    if (!(await client.logout())) {
      throw new Error("O WhatsApp nao confirmou a desconexao.");
    }
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Execution context was destroyed")) {
      throw error;
    }

    let timer;
    try {
      await Promise.race([
        pairingScreen,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Tempo esgotado.")), 90000);
        }),
      ]);
    } catch (reason) {
      throw new Error(
        "O WhatsApp nao confirmou a desconexao. Confira Dispositivos conectados no celular.",
        { cause: reason },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
