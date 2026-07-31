type BrasilApiCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  natureza_juridica?: string;
  porte?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
  descricao_situacao_cadastral?: string;
  opcao_pelo_simples?: boolean | null;
  opcao_pelo_mei?: boolean | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cnpj = (url.searchParams.get("cnpj") || "").replace(/\D/g, "");

  if (cnpj.length !== 14) {
    return Response.json(
      { error: "Informe um CNPJ válido com 14 números." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { accept: "application/json" },
    });
    const data = (await response.json()) as BrasilApiCnpj & {
      message?: string;
    };

    if (!response.ok) {
      return Response.json(
        { error: data.message || "CNPJ não encontrado na consulta pública." },
        { status: response.status === 404 ? 404 : 502 },
      );
    }

    const taxRegime = data.opcao_pelo_mei
      ? "Simples Nacional — MEI"
      : data.opcao_pelo_simples
        ? "Simples Nacional"
        : "Não informado";

    const rawSize = (data.porte || "").toUpperCase();
    const companySize = rawSize.includes("MICRO")
      ? "Microempresa (ME)"
      : rawSize.includes("PEQUENO")
        ? "Empresa de Pequeno Porte (EPP)"
        : rawSize
          ? "Demais portes"
          : "";
    const rawCnae = String(data.cnae_fiscal || "").replace(/\D/g, "");
    const cnae =
      rawCnae.length === 7
        ? `${rawCnae.slice(0, 4)}-${rawCnae.slice(4, 5)}/${rawCnae.slice(5)}`
        : String(data.cnae_fiscal || "");

    return Response.json({
      company: {
        cnpj: data.cnpj || cnpj,
        legalName: data.razao_social || "",
        tradeName: data.nome_fantasia || "",
        legalNature: data.natureza_juridica || "",
        companySize,
        cnae,
        primaryActivity: data.cnae_fiscal_descricao || "",
        registrationStatus: data.descricao_situacao_cadastral || "",
        taxRegime,
        simpleNational: Boolean(data.opcao_pelo_simples),
        mei: Boolean(data.opcao_pelo_mei),
        source: "Dados públicos do CNPJ via BrasilAPI",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "A consulta automática está indisponível agora. Continue com o preenchimento manual.",
      },
      { status: 502 },
    );
  }
}
