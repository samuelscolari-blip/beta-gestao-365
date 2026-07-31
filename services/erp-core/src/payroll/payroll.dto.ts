import { IsOptional, IsUUID, Matches } from "class-validator";

export class CreatePayrollRunDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: "A competência deve usar o formato AAAA-MM.",
  })
  competence!: string;

  @IsOptional()
  @IsUUID()
  workId?: string;
}
