<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class TurnCredentialsController extends AbstractController
{
    public function __construct(
        private string $meteredUsername,
        private string $meteredCredential
    ) {}

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET'])]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        if ($request->headers->get('X-Requested-With') === 'XMLHttpRequest') {
            return $this->json([
                [
                    'urls' => 'stun:stun.relay.metered.ca:80',
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:80',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:80?transport=tcp',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:443',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'turns:eu.relay.metered.ca:443?transport=tcp',
                    'username' => $this->meteredUsername,
                    'credential' => $this->meteredCredential
                ],
                [
                    'urls' => 'stun:stun.l.google.com:19302'
                ]
            ]);
        }
        throw $this->createAccessDeniedException('Unauthorized access');
    }
}