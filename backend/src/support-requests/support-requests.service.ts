import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportRequest, RequestStatus } from './entities/support-request.entity';
import { UsersService } from '../users/users.service';
import { VideoCallsService } from '../video-calls/video-calls.service';
import { CreateSupportRequestDto } from './dto/create-support-request.dto';
import { SupportRequestsGateway } from './support-requests.gateway';

@Injectable()
export class SupportRequestsService {
  constructor(
    @InjectRepository(SupportRequest)
    private supportRequestsRepository: Repository<SupportRequest>,
    private usersService: UsersService,
    private videoCallsService: VideoCallsService,
    private supportRequestsGateway: SupportRequestsGateway,
  ) {}

  async create(
    customerId: string,
    createDto: CreateSupportRequestDto,
  ): Promise<SupportRequest> {
    const request = this.supportRequestsRepository.create({
      ...createDto,
      customerId,
      status: RequestStatus.PENDING,
    });

    const savedRequest = await this.supportRequestsRepository.save(request);

    // Try to assign to a supporter
    const assignedRequest = await this.assignToSupporter(savedRequest.id);
    const finalRequest = await this.findOne(assignedRequest.id);

    // Notify supporters about new request
    this.supportRequestsGateway.notifyNewRequest(finalRequest);

    return finalRequest;
  }

  async findAll(filters?: {
    customerId?: string;
    supporterId?: string;
    status?: RequestStatus;
  }): Promise<SupportRequest[]> {
    const query = this.supportRequestsRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.customer', 'customer')
      .leftJoinAndSelect('request.supporter', 'supporter')
      .leftJoinAndSelect('request.videoCall', 'videoCall');

    if (filters?.customerId) {
      query.andWhere('request.customerId = :customerId', {
        customerId: filters.customerId,
      });
    }

    if (filters?.supporterId) {
      query.andWhere('request.supporterId = :supporterId', {
        supporterId: filters.supporterId,
      });
    }

    if (filters?.status) {
      query.andWhere('request.status = :status', { status: filters.status });
    }

    return query.orderBy('request.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<SupportRequest> {
    const request = await this.supportRequestsRepository.findOne({
      where: { id },
      relations: ['customer', 'supporter', 'videoCall'],
    });

    if (!request) {
      throw new NotFoundException('Support request not found');
    }

    return request;
  }

  async assignToSupporter(requestId: string): Promise<SupportRequest> {
    const request = await this.findOne(requestId);

    if (request.status !== RequestStatus.PENDING && request.status !== RequestStatus.REJECTED) {
      throw new BadRequestException('Request cannot be reassigned');
    }

    // Get filters from request
    const filters: any = {
      isAvailable: true,
      excludeIds: request.rejectedBySupporterIds || [],
    };

    // Add category-based specialty filter if applicable
    if (request.category) {
      filters.specialties = [request.category];
    }

    // Find available supporters
    const supporters = await this.usersService.findAllSupporters(filters);

    if (supporters.length === 0) {
      // No available supporters, keep as pending
      return request;
    }

    // Assign to the first available supporter
    const supporter = supporters[0];
    request.supporterId = supporter.id;
    request.status = RequestStatus.ASSIGNED;
    request.rejectedBySupporterIds = request.rejectedBySupporterIds || [];

    await this.supportRequestsRepository.save(request);
    await this.usersService.incrementRequestCount(supporter.id);

    const updatedRequest = await this.findOne(requestId);
    
    // Notify customer about assignment
    this.supportRequestsGateway.notifyRequestUpdate(updatedRequest);

    return updatedRequest;
  }

  async acceptRequest(
    requestId: string,
    supporterId: string,
  ): Promise<SupportRequest> {
    const request = await this.findOne(requestId);

    if (request.supporterId !== supporterId) {
      throw new BadRequestException('You are not assigned to this request');
    }

    if (request.status !== RequestStatus.ASSIGNED) {
      throw new BadRequestException('Request is not in assigned status');
    }

    // Create video call first with the request ID
    await this.videoCallsService.create({
      customerId: request.customerId,
      supporterId: request.supporterId,
      supportRequestId: request.id,
    });

    // Update request status to IN_PROGRESS after video call is created
    // Use update to avoid loading relations that might cause issues
    await this.supportRequestsRepository.update(requestId, {
      status: RequestStatus.IN_PROGRESS,
    });

    const updatedRequest = await this.findOne(requestId);
    
    // Notify customer about acceptance
    this.supportRequestsGateway.notifyRequestUpdate(updatedRequest);

    return updatedRequest;
  }

  async rejectRequest(
    requestId: string,
    supporterId: string,
  ): Promise<SupportRequest> {
    const request = await this.findOne(requestId);

    if (request.supporterId !== supporterId) {
      throw new BadRequestException('You are not assigned to this request');
    }

    // Add to rejected list
    if (!request.rejectedBySupporterIds) {
      request.rejectedBySupporterIds = [];
    }
    request.rejectedBySupporterIds.push(supporterId);
    request.rejectionCount = (request.rejectionCount || 0) + 1;

    // Decrement supporter's request count
    await this.usersService.decrementRequestCount(supporterId);

    // Reset assignment
    request.supporterId = null;
    request.status = RequestStatus.REJECTED;

    await this.supportRequestsRepository.save(request);

    // Try to assign to another supporter
    const assignedRequest = await this.assignToSupporter(requestId);
    const finalRequest = await this.findOne(assignedRequest.id);
    
    // Notify about rejection and reassignment
    this.supportRequestsGateway.notifyRequestUpdate(finalRequest);

    return finalRequest;
  }

  async completeRequest(requestId: string): Promise<SupportRequest> {
    const request = await this.findOne(requestId);

    if (request.status !== RequestStatus.IN_PROGRESS) {
      throw new BadRequestException('Request is not in progress');
    }

    request.status = RequestStatus.COMPLETED;

    // Decrement supporter's request count
    if (request.supporterId) {
      await this.usersService.decrementRequestCount(request.supporterId);
    }

    // End video call if exists
    if (request.videoCall) {
      await this.videoCallsService.endCall(request.videoCall.id);
    }

    await this.supportRequestsRepository.save(request);

    const updatedRequest = await this.findOne(requestId);
    
    // Notify about completion
    this.supportRequestsGateway.notifyRequestUpdate(updatedRequest);

    return updatedRequest;
  }

  async cancelRequest(requestId: string, userId: string): Promise<SupportRequest> {
    const request = await this.findOne(requestId);

    if (request.customerId !== userId && request.supporterId !== userId) {
      throw new BadRequestException('You are not authorized to cancel this request');
    }

    request.status = RequestStatus.CANCELLED;

    // Decrement supporter's request count if assigned
    if (request.supporterId) {
      await this.usersService.decrementRequestCount(request.supporterId);
    }

    // End video call if exists
    if (request.videoCall) {
      await this.videoCallsService.endCall(request.videoCall.id);
    }

    await this.supportRequestsRepository.save(request);

    const updatedRequest = await this.findOne(requestId);
    
    // Notify about cancellation
    this.supportRequestsGateway.notifyRequestUpdate(updatedRequest);

    return updatedRequest;
  }
}

