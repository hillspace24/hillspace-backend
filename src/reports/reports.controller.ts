import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EscrowService } from '../escrow/escrow.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('sales')
  @Roles(Role.AGENT, Role.SELLER, Role.ADMIN)
  @ApiOperation({ summary: 'Agent/seller sales report dashboard' })
  sales(@CurrentUser('sub') userId: string) {
    return this.escrowService.salesReport(userId);
  }
}
