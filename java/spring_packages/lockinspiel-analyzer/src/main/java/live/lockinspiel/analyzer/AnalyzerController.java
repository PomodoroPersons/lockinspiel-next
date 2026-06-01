package live.lockinspiel.analyzer;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
public class AnalyzerController {

	/***
	 * Used for health checks to ensure that the service is up and running.
	 * Typically will be used by Kubernetes to verify the state of this service.
	 * 
	 * @return A string indicating the health status of the service.
	 */
	@GetMapping("/")
	public String HealthCheck() {
		return "up";
	}

	/***
	 * Will return the total time spent working with the Pomodoro Timer running.
	 * This can be filtered by tags to isolate the time spent working on specific
	 * categories.
	 * Examples of "tags" could be: personal projects, hobbies, sports, etc.
	 * 
	 * @param tags
	 * @return Will return a string of the complete time spent working with the
	 *         Pomodoro Timer running. This may change form a string to a time based
	 *         object depending on how we want to represent the data.
	 */
	@GetMapping("/analyzer/worktime")
	public String getWorktime(@RequestParam(required = false) String tags) {
		if (tags != null) {
			// This is where we filter by tags.
		}
		return "Implement functionality";
	}

	@GetMapping("/analyzer/breaktime")
	public String getBreaktime() {

		return "Implement functionality";
	}

	/***
	 * Will return information about the ratio spent working vs taking breaks.
	 * Will be able to be filtered by school, work, and other as well to isolate the
	 * ratio for each of those categories.
	 * 
	 * @return A string representing the ratio. It is a string for now, but may be
	 *         subject to change depending on how we want to represent the data. It
	 *         could be a percentage, a ratio, or some other format.
	 * 
	 */

	@GetMapping("/analyzer/ratio")
	public String getRatio() {

		return "Implement functionality";
	}

}
