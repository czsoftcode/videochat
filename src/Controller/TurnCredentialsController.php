<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class TurnCredentialsController extends AbstractController
{
    private $httpClient;
    private $meteredApiKey;

    public function __construct(
        HttpClientInterface $httpClient,
        string $meteredApiKey
    ) {
        $this->httpClient = $httpClient;
        $this->meteredApiKey = $meteredApiKey;
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET'])]
    public function getTurnCredentials(
        string $meteredUsername,
        string $meteredCredential
    ): JsonResponse
    {
        return $this->json([
            [
                'urls' => 'turns:eu.relay.metered.ca:443?transport=tcp',
                'username' => $meteredUsername,
                'credential' => $meteredCredential
            ],
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ]
        ]);
    }
}