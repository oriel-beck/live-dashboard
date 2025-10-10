import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CacheStore } from './store/sse.store';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.html',
    styleUrl: './app.scss',
    providers: [CacheStore]
})
export class AppComponent {
}
