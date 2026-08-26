import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness / keep-alive probe' })
  check() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
