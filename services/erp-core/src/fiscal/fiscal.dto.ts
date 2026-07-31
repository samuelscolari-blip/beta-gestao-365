import {
  IsIn,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class CreateFiscalEventDto {
  @IsIn(["ESOCIAL", "EFD_REINF"])
  system!: "ESOCIAL" | "EFD_REINF";

  @IsString()
  @MaxLength(40)
  eventCode!: string;

  @IsString()
  @MaxLength(40)
  layoutVersion!: string;

  @IsIn(["RESTRICTED", "PRODUCTION"])
  environment!: "RESTRICTED" | "PRODUCTION";

  @Matches(/^[A-Za-z_][A-Za-z0-9_.:-]{0,199}$/)
  referenceId!: string;

  @IsString()
  @MaxLength(2_000_000)
  xml!: string;
}
