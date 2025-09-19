import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getStatus(): { message: string } {
    return {
      message: 'NewCourier API is running'
    };
  }
}
