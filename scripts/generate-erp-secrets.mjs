import { randomBytes } from "node:crypto";

const hmac = randomBytes(48).toString("base64url");
const encryption = randomBytes(32).toString("base64");

process.stdout.write(
  [
    "ERP_SERVICE_HMAC_SECRET=" + hmac,
    "PAYLOAD_ENCRYPTION_KEY_BASE64=" + encryption,
    "",
    "Guarde estes valores diretamente no cofre do provedor.",
    "Não salve em Git, conversa ou e-mail.",
    "",
  ].join("\n"),
);
