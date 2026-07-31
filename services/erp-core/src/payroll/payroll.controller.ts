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
import type { AuthenticatedRequest } from "../security/request-context";
import { requestContext } from "../security/request-context";
import { CreatePayrollRunDto } from "./payroll.dto";
import { PayrollService } from "./payroll.service";

@Controller("v1/payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Post("runs")
  @HttpCode(HttpStatus.ACCEPTED)
  async createRun(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreatePayrollRunDto,
  ) {
    return {
      run: await this.payroll.createRun(
        requestContext(request),
        body,
      ),
    };
  }

  @Get("runs/:id")
  async getRun(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return {
      run: await this.payroll.getRun(requestContext(request), id),
    };
  }
}
