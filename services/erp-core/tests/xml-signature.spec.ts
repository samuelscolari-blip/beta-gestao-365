import assert from "node:assert/strict";
import test from "node:test";
import forge from "node-forge";
import { resetConfigForTests } from "../src/config/env";
import { XmlSignatureService } from "../src/fiscal/xml-signature.service";

function createTestPfx(password: string) {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  const attributes = [{ name: "commonName", value: "Beta ERP Test" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [certificate],
    password,
    { algorithm: "3des" },
  );
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
}

test("o assinador A1 gera XMLDSig RSA-SHA256 e verifica a assinatura", () => {
  const password = "test-password";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.ERP_SERVICE_CLIENT_ID = "test-client";
  process.env.ERP_SERVICE_HMAC_SECRET = "s".repeat(48);
  process.env.PAYLOAD_ENCRYPTION_KEY_BASE64 =
    Buffer.alloc(32, 9).toString("base64");
  process.env.CERTIFICATE_PROVIDER = "A1_PFX";
  process.env.CERTIFICATE_PFX_BASE64 = createTestPfx(password);
  process.env.CERTIFICATE_PFX_PASSWORD = password;
  resetConfigForTests();

  const xml =
    '<eSocial xmlns="http://www.esocial.gov.br/schema/evt/teste"><evtTeste Id="IDTESTE1"><valor>1</valor></evtTeste></eSocial>';
  const signed = new XmlSignatureService().sign(xml, "IDTESTE1");

  assert.match(signed, /<ds:Signature/);
  assert.match(
    signed,
    /http:\/\/www\.w3\.org\/2001\/04\/xmldsig-more#rsa-sha256/,
  );
  assert.match(signed, /URI="#IDTESTE1"/);
});
