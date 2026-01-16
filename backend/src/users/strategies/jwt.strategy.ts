import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    console.log('JwtStrategy initialized with secret:', secret ? `${secret.substring(0, 10)}...` : 'NOT SET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('JwtStrategy validate called with payload:', {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}

