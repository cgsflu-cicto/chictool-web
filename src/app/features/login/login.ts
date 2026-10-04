import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { Router } from '@angular/router';
import { ChictoolStateService } from '../../shared/services/chictool-state.service';
import { SessionService } from '../../shared/services/session.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule, Button, InputTextModule],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class Login {
    private readonly state = inject(ChictoolStateService);
    private readonly session = inject(SessionService);
    private readonly router = inject(Router);
    readonly desktop = this.state.desktop;
    readonly hasUsers = this.state.hasUsers;
    readonly currentUser = this.state.currentUser;
    readonly authError = this.state.authError;
    readonly authForm = { username: '', password: '' };

    signIn(): Promise<void> {
        return this.authenticate('login');
    }

    createAccount(): Promise<void> {
        return this.authenticate('register');
    }

    private async authenticate(action: 'login' | 'register'): Promise<void> {
        try {
            const authenticated = await this.session.authenticate(
                action,
                this.authForm.username,
                this.authForm.password,
            );
            if (authenticated) await this.router.navigateByUrl('/computers');
        } catch (error) {
            this.state.authError.set(error instanceof Error ? error.message : 'Could not authenticate.');
        }
    }
}
