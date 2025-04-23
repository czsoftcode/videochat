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
    public function getTurnCredentials(): JsonResponse
    {
        try {
            $response = $this->httpClient->request('POST', 'https://api.metered.ca/v1/turn/credentials', [
                'query' => [
                    'apiKey' => $this->meteredApiKey
                ]
            ]);

            $credentials = $response->toArray();

            // Transformace na formát kompatibilní s WebRTC
            $iceServers = array_map(function($server) {
                return [
                    'urls' => $server['urls'],
                    'username' => $server['username'],
                    'credential' => $server['credential']
                ];
            }, $credentials);

            return $this->json($iceServers);
        } catch (\Exception $e) {
            // Fallback na STUN servery v případě selhání
            return $this->json([
                ['urls' => 'stun:stun.l.google.com:19302']
            ]);
        }
    }
}