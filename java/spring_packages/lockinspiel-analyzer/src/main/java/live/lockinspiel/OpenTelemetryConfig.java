package live.lockinspiel;

import java.util.List;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.sdk.trace.data.LinkData;
import io.opentelemetry.sdk.trace.samplers.Sampler;
import io.opentelemetry.sdk.trace.samplers.SamplingResult;

@Configuration
public class OpenTelemetryConfig {
    @Bean
    public Sampler customOtelSampler() {
        // Fallback sampler for legitimate business traffic
        Sampler rootSampler = Sampler.alwaysOn();

        return new Sampler() {
            @Override
            public SamplingResult shouldSample(
                    io.opentelemetry.context.Context parentContext,
                    String traceId,
                    String name,
                    SpanKind spanKind,
                    io.opentelemetry.api.common.Attributes attributes,
                    List<LinkData> parentLinks) {

                // Retrieve the path from modern OpenTelemetry semantic convention keys
                String urlPath = attributes.get(AttributeKey.stringKey("url.path"));
                // Fallback for older semantic conventions
                if (urlPath == null) {
                    urlPath = attributes.get(AttributeKey.stringKey("http.target"));
                }

                // If it hits an ignored route, return DROP (SamplingResult.drop())
                if (urlPath != null && urlPath.equals("/")) {
                    return SamplingResult.drop();
                }

                // Otherwise, let the default sampler handle it
                return rootSampler.shouldSample(parentContext, traceId, name, spanKind, attributes, parentLinks);
            }

            @Override
            public String getDescription() {
                return "HealthCheckFilteringSampler";
            }
        };
    }
}
