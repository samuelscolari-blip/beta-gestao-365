import { Injectable } from "@nestjs/common";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { loadConfig } from "../config/env";

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  tag: string;
};

@Injectable()
export class EncryptedPayloadService {
  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      loadConfig().payloadEncryptionKey,
      iv,
    );
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return {
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
    };
  }

  decrypt(payload: EncryptedPayload) {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      loadConfig().payloadEncryptionKey,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  }
}
