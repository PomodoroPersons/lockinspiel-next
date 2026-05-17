package live.lockinspiel.analyzer;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
public class AnalyzerController {

	@GetMapping("/")
	public String HealthCheck() {
		return "up";
	}

}
