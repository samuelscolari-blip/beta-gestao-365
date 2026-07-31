import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Matches } from "class-validator";
import type { AuthenticatedRequest } from "../security/request-context";
import { requestContext } from "../security/request-context";
import { CreateFiscalEventDto } from "./fiscal.dto";
import { FiscalService } from "./fiscal.service";

class SignFiscalEventDto {
  @Matches(/^[A-Za-z_][A-Za-z0-9_.:-]{0,199}$/)
  referenceId!: string;
}

@Controller("v1/fiscal/events")
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateFiscalEventDto,
  ) {
    return {
      event: await this.fiscal.createEvent(
        requestContext(request),
        body,
      ),
    };
  }

  @Post(":id/sign")
  @HttpCode(HttpStatus.ACCEPTED)
  async sign(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: SignFiscalEventDto,
  ) {
    return {
      event: await this.fiscal.queueSignature(
        requestContext(request),
        id,
        body.referenceId,
      ),
    };
  }

  @Get(":id")
  async get(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return {
      event: await this.fiscal.getEvent(requestContext(request), id),
    };
  }
}
