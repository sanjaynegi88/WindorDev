import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'default_jwt_secret', // ensure secret is defined
    });
  }

  // The validated user object will be attached to req.user
  async validate(payload: any) {
    // you can fetch user from DB if needed
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
