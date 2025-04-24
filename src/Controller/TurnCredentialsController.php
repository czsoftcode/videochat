<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;

class TurnCredentialsController extends AbstractController
{
    private $turnServer;
    private $turnUsername;
    private $turnPassword;

    public function __construct(ParameterBagInterface $params)
    {
        // Použijeme výchozí hodnoty, které fungují jako fallback
        $this->turnServer = $params->has('app.express_turn.server')
            ? $params->get('app.express_turn.server')
            : 'turn:turn.example.com:3478';

        $this->turnUsername = $params->has('app.express_turn.username')
            ? $params->get('app.express_turn.username')
            : 'guest';

        $this->turnPassword = $params->has('app.express_turn.password')
            ? $params->get('app.express_turn.password')
            : 'guest';
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET', 'POST'])]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        try {
            // Jednoduchá implementace bez přidání timestamp jako v předchozím příkladu


            // Pouze když máme platné TURN údaje, přidáme i TURN server
            if ($this->turnServer && $this->turnUsername && $this->turnPassword) {
                $iceServers[] = [
                    'urls' => $this->turnServer,
                    'username' => $this->turnUsername,
                    'credential' => $this->turnPassword,
                    'credentialType' => 'password'
                ];
            }

            $response = $this->json($iceServers);

            // Přidání cache control hlaviček
            $response->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
            $response->headers->set('Pragma', 'no-cache');
            $response->headers->set('Expires', '0');

            return $response;

        } catch (\Exception $e) {
            // Log error pro administrátora
            error_log('TURN credentials error: ' . $e->getMessage());

            // Vrátíme fallback hodnoty s HTTP 200 místo selhání
            return $this->json([
                ['urls' => 'stun:stun.l.google.com:19302'],
                ['urls' => 'stun:stun1.l.google.com:19302']
            ]);
        }
    }

    #[Route('/api/test', name: 'api_test', methods: ['GET'])]
    public function test(): JsonResponse
    {
        // Jednoduchý endpoint pro kontrolu, zda controller funguje
        return $this->json(['status' => 'ok', 'message' => 'API funguje!']);
    }
}