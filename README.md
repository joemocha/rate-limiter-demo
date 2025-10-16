# Fox vs. Hedgehog Rate Limiting Demo

This repository hosts the demo application used to illustrate the contrasting problem-solving approaches of the fox and the hedgehog. The project centers on a rate limiting scenario that highlights how each mindset explores or commits to a strategy when taming bursty traffic.

## Application Overview

- **Architecture**
  - **Front end**: A single-page client that lets you switch rate-limiting strategies and fire test requests.
  - **Back end**: A simple API that exposes configuration and testing endpoints to observe behavior under different algorithms and rates.
- **Purpose**: Demonstrate how broad experimentation (fox) and focused mastery (hedgehog) influence the design and tuning of rate limiting solutions.

## API Endpoints

- **POST `/settings`**
  - Configure the active rate-limiting algorithm and the allowed request rate in requests per second.
  - Supported algorithms: token bucket, leaky bucket, fixed window, sliding window, and sliding log.
- **GET `/test`**
  - Receive client requests so you can evaluate how the current configuration reacts under load.

Use the front end to toggle algorithms and rates, then observe responses from the test endpoint to compare strategies side by side.
