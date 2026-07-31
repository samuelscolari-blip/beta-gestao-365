import {
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { loadConfig } from "../config/env";

type A1Credentials = {
  privateKeyPem: string;
  certificatePem: string;
};

@Injectable()
export class XmlSignatureService {
  sign(xml: string, referenceId: string) {
    const config = loadConfig();
    if (config.certificateProvider === "DISABLED") {
      throw new ServiceUnavailableException(
        "O certificado de assinatura ainda não foi configurado.",
      );
    }
    if (config.certificateProvider === "EXTERNAL_HSM") {
      throw new ServiceUnavailableException(
        "O conector do HSM/agente A3 ainda não foi ativado.",
      );
    }
    if (
      !new RegExp(
        `\\bId\\s*=\\s*["']${escapeRegExp(referenceId)}["']`,
      ).test(xml)
    ) {
      throw new UnprocessableEntityException(
        "O XML não contém o identificador informado para assinatura.",
      );
    }

    const credentials = this.readA1Credentials();
    const referenceXpath = `//*[@Id='${referenceId}']`;
    const signature = new SignedXml({
      privateKey: credentials.privateKeyPem,
      publicCert: credentials.certificatePem,
      signatureAlgorithm:
        "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
      canonicalizationAlgorithm:
        "http://www.w3.org/2001/10/xml-exc-c14n#",
      getKeyInfoContent: SignedXml.getKeyInfoContent,
    });
    signature.addReference({
      xpath: referenceXpath,
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/2001/10/xml-exc-c14n#",
      ],
      digestAlgorithm:
        "http://www.w3.org/2001/04/xmlenc#sha256",
    });
    signature.computeSignature(xml, {
      prefix: "ds",
      location: { reference: referenceXpath, action: "after" },
    });
    const signedXml = signature.getSignedXml();
    this.verify(signedXml, credentials.certificatePem);
    return signedXml;
  }

  private readA1Credentials(): A1Credentials {
    const config = loadConfig();
    try {
      const der = forge.util.decode64(config.certificatePfxBase64);
      const asn1 = forge.asn1.fromDer(der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(
        asn1,
        false,
        config.certificatePfxPassword,
      );
      const keyBags = [
        ...(p12.getBags({
          bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
        })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
        ...(p12.getBags({
          bagType: forge.pki.oids.keyBag,
        })[forge.pki.oids.keyBag] || []),
      ].filter(Boolean);
      const certBags =
        p12.getBags({
          bagType: forge.pki.oids.certBag,
        })[forge.pki.oids.certBag] || [];
      const privateKey = keyBags.find((bag) => bag.key)?.key;
      const certificate = certBags.find((bag) => bag.cert)?.cert;
      if (!privateKey || !certificate) {
        throw new Error("Chave ou certificado não encontrado no PFX.");
      }
      return {
        privateKeyPem: forge.pki.privateKeyToPem(privateKey),
        certificatePem: forge.pki.certificateToPem(certificate),
      };
    } catch {
      throw new ServiceUnavailableException(
        "Não foi possível abrir o certificado A1 configurado.",
      );
    }
  }

  private verify(signedXml: string, certificatePem: string) {
    const document = new DOMParser().parseFromString(
      signedXml,
      "application/xml",
    );
    const signatureNode = xpath.select1(
      "//*[local-name(.)='Signature']",
      document,
    );
    if (!signatureNode) {
      throw new UnprocessableEntityException(
        "A assinatura XML não foi gerada.",
      );
    }
    const verifier = new SignedXml({
      publicCert: certificatePem,
      getCertFromKeyInfo: () => null,
    });
    verifier.loadSignature(signatureNode as unknown as Node);
    if (!verifier.checkSignature(signedXml)) {
      throw new UnprocessableEntityException(
        "A validação criptográfica da assinatura XML falhou.",
      );
    }
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
