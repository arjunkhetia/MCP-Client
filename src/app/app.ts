import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Dashboard],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
