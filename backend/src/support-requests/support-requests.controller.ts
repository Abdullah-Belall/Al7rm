import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { SupportRequestsService } from './support-requests.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { JwtAuthGuard } from '../users/guards/jwt-auth.guard';
import { RequestStatus } from './entities/support-request.entity';

@Controller('support-requests')
@UseGuards(JwtAuthGuard)
export class SupportRequestsController {
  constructor(
    private readonly supportRequestsService: SupportRequestsService,
  ) {}

  @Post()
  async create(@Request() req, @Body() createDto: CreateSupportRequestDto) {
    return this.supportRequestsService.create(req.user.userId, createDto);
  }

  @Get()
  async findAll(
    @Request() req,
    @Query('status') status?: RequestStatus,
  ) {
    const filters: any = {};

    // Customers see their own requests, supporters see assigned requests
    if (req.user.role === 'customer') {
      filters.customerId = req.user.userId;
    } else if (req.user.role === 'supporter') {
      filters.supporterId = req.user.userId;
    }

    if (status) {
      filters.status = status;
    }

    return this.supportRequestsService.findAll(filters);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.supportRequestsService.findOne(id);
  }

  @Patch(':id/accept')
  async accept(@Param('id') id: string, @Request() req) {
    return this.supportRequestsService.acceptRequest(id, req.user.userId);
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Request() req) {
    return this.supportRequestsService.rejectRequest(id, req.user.userId);
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string) {
    return this.supportRequestsService.completeRequest(id);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req) {
    return this.supportRequestsService.cancelRequest(id, req.user.userId);
  }
}

