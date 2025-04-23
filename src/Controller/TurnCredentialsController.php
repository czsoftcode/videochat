<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class TurnCredentialsController extends AbstractController
{
    /**
     * Základní URL pro Metered TURN API s vlastní subdoménou
     */
    private const METERED_TURN_API_URL = 'https://softcode.metered.live/api/v1/turn/credentials';

    public function __construct(
        private string $meteredApiKey,
        private HttpClientInterface $httpClient
    ) {
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET', 'POST', 'OPTIONS'])]
    public function getTurnCredentials(Request $request): Response
    {
        // Přidám logování pro diagnostiku
        dd('TURN credentials request received from: ' . $request->getClientIp());
        dd('API Key set: ' . (empty($this->meteredApiKey) || $this->meteredApiKey === '%env(METERED_API_KEY)%' ? 'NO' : 'YES'));

        // Pro OPTIONS požadavky (CORS preflight)
        if ($request->isMethod('OPTIONS')) {
            $response = new Response('', Response::HTTP_NO_CONTENT);
            $this->setCorsHeaders($response);
            return $response;
        }

        try {
            // Volání Metered API
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);
            error_log('Calling Metered API at: ' . self::METERED_TURN_API_URL);

            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'VideoChat/1.0'
                ]
            ]);

            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();
                error_log('Successfully got TURN servers: ' . count($data));

                $jsonResponse = new JsonResponse($data);
                $this->setCorsHeaders($jsonResponse);
                return $jsonResponse;
            }

            // Logování chyby
            error_log('Metered API error: ' . $response->getStatusCode() . ' - ' . $response->getContent(false));

        } catch (\Exception $e) {
            error_log('Exception when calling Metered API: ' . $e->getMessage());
        }

        // Fallback response
        $fallbackResponse = new JsonResponse($this->getFallbackServers());
        $this->setCorsHeaders($fallbackResponse);
        return $fallbackResponse;
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials_post', methods: ['POST'])]
    public function postTurnCredentials(Request $request): JsonResponse
    {
        // Stejná implementace pro POST i GET
        return $this->getMeteredTurnCredentials($request);
    }

    /**
     * Získá dočasné TURN credentials pomocí Metered API
     */
    // V metodě getMeteredTurnCredentials()
    private function getMeteredTurnCredentials(Request $request): JsonResponse
    {
        // Přímé přesměrování na Metered API
        try {
            // Použijeme URL pro Metered TURN API s vlastní subdoménou a API klíčem
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);

            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'VideoChat/1.0 (Symfony)'
                ]
            ]);

            // Pouze vracíme data z Metered API přímo klientovi
            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();
                $jsonResponse = $this->json($data);

                // Nastavíme správné CORS a Cache hlavičky
                $jsonResponse->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
                $jsonResponse->headers->set('Access-Control-Allow-Origin', '*');

                return $jsonResponse;
            }
        } catch (\Exception $e) {
            // V případě chyby použijeme záložní přístup
            error_log('Výjimka při získávání TURN credentials: ' . $e->getMessage());
        }

        return $this->getFallbackIceServers();
    }

    /**
     * Záložní ICE servery - pouze veřejné STUN servery
     */
    private function getFallbackServers(): array
    {
        return [
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun1.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun2.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun.relay.metered.ca:80'
            ]
        ];
    }

    private function setCorsHeaders(Response $response): void
    {
        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
        $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}