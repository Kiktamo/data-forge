import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class JwtHelperService {
  /**
   * Decodes a JWT token to get its payload
   */
  public decodeToken(token: string): any {
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT token must have 3 parts');
    }

    try {
      // URL-safe base64 decode
      const decoded = this.urlBase64Decode(parts[1]);
      if (!decoded) {
        throw new Error('Cannot decode the token');
      }

      return JSON.parse(decoded);
    } catch (e) {
      throw new Error('Invalid token specified');
    }
  }

  /**
   * Checks if a token is expired
   */
  public isTokenExpired(token: string, offsetSeconds: number = 0): boolean {
    if (!token) {
      return true;
    }

    const date = this.getTokenExpirationDate(token);
    
    if (!date) {
      return false;
    }

    return !(date.valueOf() > new Date().valueOf() + offsetSeconds * 1000);
  }

  /**
   * Gets the expiration date from a token
   */
  public getTokenExpirationDate(token: string): Date | null {
    const decoded = this.decodeToken(token);

    if (!decoded || !decoded.exp) {
      return null;
    }

    const date = new Date(0); // The 0 sets the date to the epoch
    date.setUTCSeconds(decoded.exp);
    return date;
  }

  /**
   * URL-safe base64 decode
   */
  private urlBase64Decode(str: string): string {
    let output = str.replace(/-/g, '+').replace(/_/g, '/');
    
    switch (output.length % 4) {
      case 0: {
        break;
      }
      case 2: {
        output += '==';
        break;
      }
      case 3: {
        output += '=';
        break;
      }
      default: {
        throw new Error('Illegal base64url string!');
      }
    }

    // Use native window atob function to decode base64
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(output), (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
    } catch (err) {
      return atob(output);
    }
  }
}